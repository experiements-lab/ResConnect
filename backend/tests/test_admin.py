from sqlalchemy import select
from app.models.notification import Notification


async def test_verify_student_rejects_wrong_admin_key(client, make_student):
    student = await make_student(verification_status="pending")

    resp = await client.post(f"/admin/students/{student.id}/verify", headers={"X-Admin-Key": "wrong-key"})

    assert resp.status_code == 403


async def test_verify_student_requires_admin_key_header(client, make_student):
    student = await make_student(verification_status="pending")

    resp = await client.post(f"/admin/students/{student.id}/verify")

    assert resp.status_code == 422


async def test_verify_student_updates_status_and_notifies(client, db_session, admin_headers, make_student):
    student = await make_student(verification_status="pending")

    resp = await client.post(f"/admin/students/{student.id}/verify", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["verification_status"] == "verified"
    notif = (await db_session.execute(
        select(Notification).where(Notification.identity_id == student.identity_id)
    )).scalar_one()
    assert notif.type == "account_verified"


async def test_verify_student_succeeds_even_when_notification_creation_fails(
    client, db_session, admin_headers, make_student, monkeypatch
):
    """Same regression coverage as the enquiry flow: admin verification must
    commit regardless of whether the notification side-effect succeeds."""
    student = await make_student(verification_status="pending")

    async def _boom(*args, **kwargs):
        raise RuntimeError("simulated notifications table missing")
    monkeypatch.setattr("app.api.admin.create_notification", _boom)

    resp = await client.post(f"/admin/students/{student.id}/verify", headers=admin_headers)

    assert resp.status_code == 200
    await db_session.refresh(student)
    assert student.verification_status == "verified"


async def test_reject_student_requires_reason(client, admin_headers, make_student):
    student = await make_student(verification_status="pending")

    resp = await client.post(f"/admin/students/{student.id}/reject", headers=admin_headers, json={"reason": ""})

    assert resp.status_code == 422


async def test_reject_landlord_sets_status_and_reason(client, db_session, admin_headers, make_landlord):
    landlord = await make_landlord(verification_status="pending")

    resp = await client.post(
        f"/admin/landlords/{landlord.id}/reject", headers=admin_headers, json={"reason": "Ownership docs unclear"}
    )

    assert resp.status_code == 200
    await db_session.refresh(landlord)
    assert landlord.verification_status == "rejected"
    assert landlord.reject_reason == "Ownership docs unclear"


async def test_student_doc_url_returns_502_on_storage_error(client, db_session, admin_headers, make_student, monkeypatch):
    from app.core.storage import StorageError
    student = await make_student()
    student.registration_doc_key = "some/key.pdf"
    await db_session.commit()

    def _boom(*a, **k):
        raise StorageError("simulated storage outage")
    monkeypatch.setattr("app.api.admin.get_presigned_url", _boom)

    resp = await client.get(f"/admin/students/{student.id}/doc", headers=admin_headers)

    assert resp.status_code == 502
