import uuid
from sqlalchemy import select
from app.models.student import Student


async def test_create_student_profile_success(client, auth_as):
    identity_id = uuid.uuid4()
    auth_as(identity_id, "student")

    resp = await client.post("/students/me", json={
        "student_number": "12345678", "full_name": "Jane Student", "sun_email": "jane@sun.ac.za",
    })

    assert resp.status_code == 200
    assert resp.json()["verification_status"] == "pending"


async def test_create_student_profile_rejects_duplicate(client, auth_as):
    identity_id = uuid.uuid4()
    auth_as(identity_id, "student")
    payload = {"student_number": "12345678", "full_name": "Jane Student", "sun_email": "jane@sun.ac.za"}
    await client.post("/students/me", json=payload)

    resp = await client.post("/students/me", json={**payload, "sun_email": "other@sun.ac.za", "student_number": "87654321"})

    assert resp.status_code == 409


async def test_get_my_profile_not_found(client, auth_as):
    auth_as(uuid.uuid4(), "student")

    resp = await client.get("/students/me")

    assert resp.status_code == 404


async def test_update_my_profile_applies_partial_update(client, auth_as, make_student):
    student = await make_student()
    auth_as(student.identity_id, "student")

    resp = await client.patch("/students/me", json={"faculty": "Engineering"})

    assert resp.status_code == 200
    assert resp.json()["faculty"] == "Engineering"
    assert resp.json()["full_name"] == student.full_name


async def test_sync_student_profile_requires_student_role(client, auth_as, make_landlord):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")

    resp = await client.post("/students/me/sync")

    assert resp.status_code == 403


async def test_sync_student_profile_rejects_non_sun_email(client, auth_as, monkeypatch):
    identity_id = uuid.uuid4()

    async def _fake(request):
        return {"identity": {"id": str(identity_id), "traits": {"role": "student", "email": "jane@gmail.com"}}}
    monkeypatch.setattr("app.api.students.get_kratos_session", _fake)

    resp = await client.post("/students/me/sync")

    assert resp.status_code == 400


async def test_sync_student_profile_creates_from_traits(client, db_session, auth_as, monkeypatch):
    identity_id = uuid.uuid4()

    async def _fake(request):
        return {
            "identity": {
                "id": str(identity_id),
                "traits": {"role": "student", "email": "jane@sun.ac.za", "full_name": "Jane Sync", "student_number": "11112222"},
            }
        }
    monkeypatch.setattr("app.api.students.get_kratos_session", _fake)

    resp = await client.post("/students/me/sync")

    assert resp.status_code == 200
    assert resp.json()["sun_email"] == "jane@sun.ac.za"
    student = (await db_session.execute(
        select(Student).where(Student.identity_id == identity_id)
    )).scalar_one()
    assert student.full_name == "Jane Sync"


async def test_sync_student_profile_returns_existing_without_update(client, auth_as, make_student, monkeypatch):
    student = await make_student()

    async def _fake(request):
        return {
            "identity": {
                "id": str(student.identity_id),
                "traits": {"role": "student", "email": "different@sun.ac.za", "full_name": "Should Not Apply"},
            }
        }
    monkeypatch.setattr("app.api.students.get_kratos_session", _fake)

    resp = await client.post("/students/me/sync")

    assert resp.status_code == 200
    assert resp.json()["sun_email"] == student.sun_email
    assert resp.json()["full_name"] == student.full_name


async def test_upload_registration_doc_rejects_bad_content_type(client, auth_as, make_student, mock_storage):
    student = await make_student()
    auth_as(student.identity_id, "student")
    mock_storage(["app.api.students"])

    resp = await client.post(
        "/students/me/upload-registration",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert resp.status_code == 400


async def test_upload_registration_doc_rejects_oversized_file(client, auth_as, make_student, mock_storage):
    student = await make_student()
    auth_as(student.identity_id, "student")
    mock_storage(["app.api.students"])
    oversized = b"0" * (10 * 1024 * 1024 + 1)

    resp = await client.post(
        "/students/me/upload-registration",
        files={"file": ("doc.pdf", oversized, "application/pdf")},
    )

    assert resp.status_code == 400


async def test_upload_registration_doc_success_resets_verification_status(
    client, db_session, auth_as, make_student, mock_storage
):
    student = await make_student(verification_status="verified")
    auth_as(student.identity_id, "student")
    mock_storage(["app.api.students"])

    resp = await client.post(
        "/students/me/upload-registration",
        files={"file": ("doc.pdf", b"fake-pdf-bytes", "application/pdf")},
    )

    assert resp.status_code == 200
    await db_session.refresh(student)
    assert student.verification_status == "pending"
    assert student.registration_doc_key is not None


async def test_get_registration_doc_url_not_found(client, auth_as, make_student):
    student = await make_student()
    auth_as(student.identity_id, "student")

    resp = await client.get("/students/me/registration-doc")

    assert resp.status_code == 404


async def test_get_registration_doc_url_returns_presigned_url(client, auth_as, make_student, mock_storage):
    student = await make_student()
    auth_as(student.identity_id, "student")
    mock_storage(["app.api.students"])
    await client.post(
        "/students/me/upload-registration",
        files={"file": ("doc.pdf", b"fake-pdf-bytes", "application/pdf")},
    )

    resp = await client.get("/students/me/registration-doc")

    assert resp.status_code == 200
    assert resp.json()["url"] == "https://example.com/signed-url"


async def test_get_registration_doc_url_returns_502_on_storage_error(client, db_session, auth_as, make_student, monkeypatch):
    from app.core.storage import StorageError
    student = await make_student()
    student.registration_doc_key = "some/key.pdf"
    await db_session.commit()
    auth_as(student.identity_id, "student")

    def _boom(*a, **k):
        raise StorageError("simulated storage outage")
    monkeypatch.setattr("app.api.students.get_presigned_url", _boom)

    resp = await client.get("/students/me/registration-doc")

    assert resp.status_code == 502


async def test_delete_registration_doc_clears_key(client, db_session, auth_as, make_student, mock_storage):
    student = await make_student()
    auth_as(student.identity_id, "student")
    mock_storage(["app.api.students"])
    await client.post(
        "/students/me/upload-registration",
        files={"file": ("doc.pdf", b"fake-pdf-bytes", "application/pdf")},
    )

    resp = await client.delete("/students/me/registration-doc")

    assert resp.status_code == 200
    await db_session.refresh(student)
    assert student.registration_doc_key is None
