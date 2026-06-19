import uuid
from sqlalchemy import select
from app.models.landlord import Landlord


async def test_create_landlord_profile_success(client, auth_as):
    identity_id = uuid.uuid4()
    auth_as(identity_id, "landlord")

    resp = await client.post("/landlords/me", json={
        "full_name": "Jane Landlord", "email": "jane@example.com", "phone": "0821234567",
    })

    assert resp.status_code == 200
    assert resp.json()["verification_status"] == "pending"


async def test_create_landlord_profile_rejects_duplicate(client, auth_as):
    identity_id = uuid.uuid4()
    auth_as(identity_id, "landlord")
    payload = {"full_name": "Jane Landlord", "email": "jane@example.com", "phone": "0821234567"}
    await client.post("/landlords/me", json=payload)

    resp = await client.post("/landlords/me", json={**payload, "email": "other@example.com"})

    assert resp.status_code == 409


async def test_get_my_profile_not_found(client, auth_as):
    auth_as(uuid.uuid4(), "landlord")

    resp = await client.get("/landlords/me")

    assert resp.status_code == 404


async def test_update_my_profile_applies_partial_update(client, auth_as, make_landlord):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")

    resp = await client.patch("/landlords/me", json={"phone": "0839998888"})

    assert resp.status_code == 200
    assert resp.json()["phone"] == "0839998888"
    assert resp.json()["full_name"] == landlord.full_name


async def test_update_my_profile_cannot_change_email(client, auth_as, make_landlord):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")

    resp = await client.patch("/landlords/me", json={"email": "new@example.com"})

    assert resp.status_code == 200
    assert resp.json()["email"] == landlord.email


async def test_sync_landlord_profile_requires_landlord_role(client, auth_as, make_student):
    student = await make_student()
    auth_as(student.identity_id, "student")

    resp = await client.post("/landlords/me/sync")

    assert resp.status_code == 403


async def test_sync_landlord_profile_creates_from_traits(client, db_session, auth_as, monkeypatch):
    identity_id = uuid.uuid4()

    async def _fake(request):
        return {
            "identity": {
                "id": str(identity_id),
                "traits": {"role": "landlord", "email": "jane@example.com", "full_name": "Jane Sync", "phone": "0821112222"},
            }
        }
    monkeypatch.setattr("app.api.landlords.get_kratos_session", _fake)

    resp = await client.post("/landlords/me/sync")

    assert resp.status_code == 200
    assert resp.json()["email"] == "jane@example.com"
    landlord = (await db_session.execute(
        select(Landlord).where(Landlord.identity_id == identity_id)
    )).scalar_one()
    assert landlord.full_name == "Jane Sync"


async def test_sync_landlord_profile_returns_existing_without_update(client, auth_as, make_landlord, monkeypatch):
    landlord = await make_landlord()

    async def _fake(request):
        return {
            "identity": {
                "id": str(landlord.identity_id),
                "traits": {"role": "landlord", "email": "different@example.com", "full_name": "Should Not Apply"},
            }
        }
    monkeypatch.setattr("app.api.landlords.get_kratos_session", _fake)

    resp = await client.post("/landlords/me/sync")

    assert resp.status_code == 200
    assert resp.json()["email"] == landlord.email
    assert resp.json()["full_name"] == landlord.full_name


async def test_upload_ownership_doc_rejects_bad_content_type(client, auth_as, make_landlord, mock_storage):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.landlords"])

    resp = await client.post(
        "/landlords/me/upload-ownership",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert resp.status_code == 400


async def test_upload_ownership_doc_rejects_oversized_file(client, auth_as, make_landlord, mock_storage):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.landlords"])
    oversized = b"0" * (10 * 1024 * 1024 + 1)

    resp = await client.post(
        "/landlords/me/upload-ownership",
        files={"file": ("doc.pdf", oversized, "application/pdf")},
    )

    assert resp.status_code == 400


async def test_upload_ownership_doc_success_resets_verification_status(
    client, db_session, auth_as, make_landlord, mock_storage
):
    landlord = await make_landlord(verification_status="verified")
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.landlords"])

    resp = await client.post(
        "/landlords/me/upload-ownership",
        files={"file": ("doc.pdf", b"fake-pdf-bytes", "application/pdf")},
    )

    assert resp.status_code == 200
    await db_session.refresh(landlord)
    assert landlord.verification_status == "pending"
    assert landlord.ownership_doc_key is not None


async def test_get_ownership_doc_url_not_found(client, auth_as, make_landlord):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")

    resp = await client.get("/landlords/me/ownership-doc")

    assert resp.status_code == 404


async def test_get_ownership_doc_url_returns_presigned_url(client, auth_as, make_landlord, mock_storage):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.landlords"])
    await client.post(
        "/landlords/me/upload-ownership",
        files={"file": ("doc.pdf", b"fake-pdf-bytes", "application/pdf")},
    )

    resp = await client.get("/landlords/me/ownership-doc")

    assert resp.status_code == 200
    assert resp.json()["url"] == "https://example.com/signed-url"


async def test_delete_ownership_doc_clears_key(client, db_session, auth_as, make_landlord, mock_storage):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.landlords"])
    await client.post(
        "/landlords/me/upload-ownership",
        files={"file": ("doc.pdf", b"fake-pdf-bytes", "application/pdf")},
    )

    resp = await client.delete("/landlords/me/ownership-doc")

    assert resp.status_code == 200
    await db_session.refresh(landlord)
    assert landlord.ownership_doc_key is None
