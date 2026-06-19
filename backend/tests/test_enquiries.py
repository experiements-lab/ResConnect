from sqlalchemy import select
from app.models.enquiry import Enquiry
from app.models.notification import Notification
from app.models.property import Room


async def test_send_enquiry_creates_enquiry_and_notifies_landlord(client, db_session, auth_as, make_student, make_landlord, make_room):
    student = await make_student()
    landlord = await make_landlord()
    room, _ = await make_room(landlord)
    auth_as(student.identity_id, "student")

    resp = await client.post("/enquiries/", json={"room_id": str(room.id), "message": "Hi, is this room available?"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["room_id"] == str(room.id)
    assert body["status"] == "sent"
    assert body["booking_status"] == "enquiring"

    notif = (await db_session.execute(
        select(Notification).where(Notification.identity_id == landlord.identity_id)
    )).scalar_one()
    assert notif.type == "new_enquiry"


async def test_send_enquiry_succeeds_even_when_notification_creation_fails(
    client, db_session, auth_as, make_student, make_landlord, make_room, monkeypatch
):
    """Regression test for the production incident where a missing notifications
    table rolled back the whole request and broke enquiry creation. Notification
    failures must never take down the primary action."""
    student = await make_student()
    landlord = await make_landlord()
    room, _ = await make_room(landlord)
    auth_as(student.identity_id, "student")

    async def _boom(*args, **kwargs):
        raise RuntimeError("simulated notifications table missing")
    monkeypatch.setattr("app.api.enquiries.create_notification", _boom)

    resp = await client.post("/enquiries/", json={"room_id": str(room.id), "message": "Hi, is this room available?"})

    assert resp.status_code == 200
    enquiry = (await db_session.execute(select(Enquiry).where(Enquiry.room_id == room.id))).scalar_one()
    assert enquiry.student_id == student.id
    assert (await db_session.execute(select(Notification))).scalars().all() == []


async def test_send_enquiry_rejects_unverified_student(client, auth_as, make_student, make_landlord, make_room):
    student = await make_student(verification_status="pending")
    landlord = await make_landlord()
    room, _ = await make_room(landlord)
    auth_as(student.identity_id, "student")

    resp = await client.post("/enquiries/", json={"room_id": str(room.id), "message": "Hi there"})

    assert resp.status_code == 403


async def test_send_enquiry_rejects_duplicate(client, auth_as, make_student, make_landlord, make_room):
    student = await make_student()
    landlord = await make_landlord()
    room, _ = await make_room(landlord)
    auth_as(student.identity_id, "student")

    first = await client.post("/enquiries/", json={"room_id": str(room.id), "message": "Hi there"})
    second = await client.post("/enquiries/", json={"room_id": str(room.id), "message": "Hi again"})

    assert first.status_code == 200
    assert second.status_code == 409


async def test_respond_to_enquiry_notifies_student_even_when_notification_fails(
    client, db_session, auth_as, make_student, make_landlord, make_room, monkeypatch
):
    student = await make_student()
    landlord = await make_landlord()
    room, _ = await make_room(landlord)

    auth_as(student.identity_id, "student")
    create = await client.post("/enquiries/", json={"room_id": str(room.id), "message": "Hi there"})
    enquiry_id = create.json()["id"]

    auth_as(landlord.identity_id, "landlord")
    async def _boom(*args, **kwargs):
        raise RuntimeError("simulated notification failure")
    monkeypatch.setattr("app.api.enquiries.create_notification", _boom)

    resp = await client.post(f"/enquiries/{enquiry_id}/respond", json={"response": "Yes, still available!"})

    assert resp.status_code == 200
    assert resp.json()["status"] == "responded"
    assert resp.json()["landlord_response"] == "Yes, still available!"


async def test_accept_enquiry_decrements_room_availability(client, db_session, auth_as, make_student, make_landlord, make_room):
    student = await make_student()
    landlord = await make_landlord()
    room, _ = await make_room(landlord, available_count=1)

    auth_as(student.identity_id, "student")
    create = await client.post("/enquiries/", json={"room_id": str(room.id), "message": "Hi there"})
    enquiry_id = create.json()["id"]

    auth_as(landlord.identity_id, "landlord")
    resp = await client.post(f"/enquiries/{enquiry_id}/accept")

    assert resp.status_code == 200
    assert resp.json()["booking_status"] == "accepted"
    await db_session.refresh(room)
    assert room.available_count == 0
    assert room.is_available is False
