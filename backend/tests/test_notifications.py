import uuid
from app.models.notification import Notification


async def test_unread_count_and_mark_all_read(client, db_session, auth_as):
    identity_id = uuid.uuid4()
    db_session.add_all([
        Notification(identity_id=identity_id, type="new_enquiry", title="A"),
        Notification(identity_id=identity_id, type="new_enquiry", title="B"),
        Notification(identity_id=uuid.uuid4(), type="new_enquiry", title="Someone else's"),
    ])
    await db_session.commit()
    auth_as(identity_id, "student", modules=("app.api.notifications",))

    before = await client.get("/notifications/me/unread-count")
    assert before.json() == {"count": 2}

    mark_all = await client.post("/notifications/me/read-all")
    assert mark_all.status_code == 200

    after = await client.get("/notifications/me/unread-count")
    assert after.json() == {"count": 0}


async def test_mark_single_notification_read(client, db_session, auth_as):
    identity_id = uuid.uuid4()
    notif = Notification(identity_id=identity_id, type="new_message", title="New message")
    db_session.add(notif)
    await db_session.commit()
    await db_session.refresh(notif)
    auth_as(identity_id, "student", modules=("app.api.notifications",))

    resp = await client.patch(f"/notifications/{notif.id}/read")

    assert resp.status_code == 200
    await db_session.refresh(notif)
    assert notif.is_read is True


async def test_notifications_require_auth(client):
    resp = await client.get("/notifications/me")

    assert resp.status_code == 401
