from sqlalchemy import select
from app.models.property import Property, PropertyPhoto


def _room_payload(**overrides):
    payload = {"room_type": "single", "price_per_month": 3500}
    payload.update(overrides)
    return payload


async def test_create_property_requires_landlord_role(client, auth_as, make_student):
    student = await make_student()
    auth_as(student.identity_id, "student")

    resp = await client.post("/properties/", json={
        "name": "Test Property", "address": "1 Test St", "rooms": [_room_payload()],
    })

    assert resp.status_code == 403


async def test_create_property_requires_landlord_profile(client, auth_as):
    import uuid
    auth_as(uuid.uuid4(), "landlord")

    resp = await client.post("/properties/", json={
        "name": "Test Property", "address": "1 Test St", "rooms": [_room_payload()],
    })

    assert resp.status_code == 403
    assert resp.json()["detail"] == "Landlord profile required"


async def test_create_property_rejects_empty_rooms(client, auth_as, make_landlord):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")

    resp = await client.post("/properties/", json={
        "name": "Test Property", "address": "1 Test St", "rooms": [],
    })

    assert resp.status_code == 400


async def test_create_property_success(client, db_session, auth_as, make_landlord):
    landlord = await make_landlord()
    auth_as(landlord.identity_id, "landlord")

    resp = await client.post("/properties/", json={
        "name": "Digs on Bird St", "address": "12 Bird St, Stellenbosch",
        "rooms": [_room_payload(), _room_payload(room_type="double", price_per_month=2800)],
    })

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["rooms"]) == 2
    assert body["cover_photo_url"] is None
    prop = (await db_session.execute(select(Property).where(Property.id == body["id"]))).scalar_one()
    assert prop.landlord_id == landlord.id


async def test_list_properties_excludes_unverified_landlord(client, make_landlord, make_room):
    landlord = await make_landlord(verification_status="pending")
    await make_room(landlord)

    resp = await client.get("/properties/")

    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_properties_excludes_inactive_property(client, make_landlord, make_room):
    landlord = await make_landlord()
    await make_room(landlord, is_active=False)

    resp = await client.get("/properties/")

    assert resp.json() == []


async def test_list_properties_filters_by_min_price(client, make_landlord, make_room):
    landlord = await make_landlord()
    await make_room(landlord, price=2000)
    await make_room(landlord, price=5000)

    resp = await client.get("/properties/", params={"min_price": 3000})

    assert resp.status_code == 200
    prices = [room["price_per_month"] for prop in resp.json() for room in prop["rooms"]]
    assert prices == [5000]


async def test_list_properties_filters_by_room_type(client, make_landlord, make_room):
    landlord = await make_landlord()
    await make_room(landlord, room_type="single")
    await make_room(landlord, room_type="double")

    resp = await client.get("/properties/", params={"room_type": "double"})

    room_types = [room["room_type"] for prop in resp.json() for room in prop["rooms"]]
    assert room_types == ["double"]


async def test_list_properties_filters_nsfas_only(client, make_landlord, make_room):
    landlord = await make_landlord()
    await make_room(landlord, nsfas_accepted=False)
    await make_room(landlord, nsfas_accepted=True)

    resp = await client.get("/properties/", params={"nsfas_only": True})

    rooms = [room for prop in resp.json() for room in prop["rooms"]]
    assert len(rooms) == 1
    assert rooms[0]["nsfas_accepted"] is True


async def test_list_properties_filters_by_amenities(client, make_landlord, make_room):
    landlord = await make_landlord()
    await make_room(landlord, amenities={"wifi": True})
    await make_room(landlord, amenities={"wifi": True, "parking": True})

    resp = await client.get("/properties/", params={"amenities": "wifi,parking"})

    rooms = [room for prop in resp.json() for room in prop["rooms"]]
    assert len(rooms) == 1
    assert rooms[0]["amenities"] == {"wifi": True, "parking": True}


async def test_get_property_not_found(client):
    import uuid
    resp = await client.get(f"/properties/{uuid.uuid4()}")

    assert resp.status_code == 404


async def test_get_property_returns_existing(client, make_landlord, make_room):
    landlord = await make_landlord()
    room, prop = await make_room(landlord)

    resp = await client.get(f"/properties/{prop.id}")

    assert resp.status_code == 200
    assert resp.json()["id"] == str(prop.id)


async def test_update_property_rejects_non_owner(client, auth_as, make_landlord, make_room):
    owner = await make_landlord()
    other = await make_landlord()
    _, prop = await make_room(owner)
    auth_as(other.identity_id, "landlord")

    resp = await client.patch(f"/properties/{prop.id}", json={"name": "Hijacked"})

    assert resp.status_code == 404


async def test_update_property_applies_partial_update(client, auth_as, make_landlord, make_room):
    landlord = await make_landlord()
    _, prop = await make_room(landlord)
    auth_as(landlord.identity_id, "landlord")

    resp = await client.patch(f"/properties/{prop.id}", json={"name": "Renamed Digs"})

    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Digs"
    assert resp.json()["address"] == prop.address


async def test_update_room_filters_unknown_amenity_keys(client, db_session, auth_as, make_landlord, make_room):
    landlord = await make_landlord()
    room, prop = await make_room(landlord)
    auth_as(landlord.identity_id, "landlord")

    resp = await client.patch(
        f"/properties/{prop.id}/rooms/{room.id}",
        json={"amenities": {"wifi": True, "not_a_real_amenity": True}},
    )

    assert resp.status_code == 200
    assert resp.json()["amenities"] == {"wifi": True}


async def test_toggle_room_availability(client, auth_as, make_landlord, make_room):
    landlord = await make_landlord()
    room, prop = await make_room(landlord)
    auth_as(landlord.identity_id, "landlord")
    assert room.is_available is True

    resp = await client.patch(f"/properties/{prop.id}/rooms/{room.id}/toggle")

    assert resp.status_code == 200
    assert resp.json()["is_available"] is False


async def test_upload_photo_rejects_bad_content_type(client, auth_as, make_landlord, make_room, mock_storage):
    landlord = await make_landlord()
    _, prop = await make_room(landlord)
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.properties"])

    resp = await client.post(
        f"/properties/{prop.id}/photos",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert resp.status_code == 400


async def test_upload_photo_rejects_oversized_file(client, auth_as, make_landlord, make_room, mock_storage):
    landlord = await make_landlord()
    _, prop = await make_room(landlord)
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.properties"])
    oversized = b"0" * (5 * 1024 * 1024 + 1)

    resp = await client.post(
        f"/properties/{prop.id}/photos",
        files={"file": ("big.jpg", oversized, "image/jpeg")},
    )

    assert resp.status_code == 400


async def test_upload_photo_success_and_set_as_cover(client, db_session, auth_as, make_landlord, make_room, mock_storage):
    landlord = await make_landlord()
    _, prop = await make_room(landlord)
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.properties"])

    resp = await client.post(
        f"/properties/{prop.id}/photos",
        params={"is_cover": True},
        files={"file": ("room.jpg", b"fake-image-bytes", "image/jpeg")},
    )

    assert resp.status_code == 200
    photo = (await db_session.execute(select(PropertyPhoto).where(PropertyPhoto.property_id == prop.id))).scalar_one()
    assert photo.is_cover is True

    fetched = await client.get(f"/properties/{prop.id}")
    assert fetched.json()["cover_photo_url"] == "https://example.com/signed-url"


async def test_delete_photo_removes_record(client, db_session, auth_as, make_landlord, make_room, mock_storage):
    landlord = await make_landlord()
    _, prop = await make_room(landlord)
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.properties"])
    upload = await client.post(
        f"/properties/{prop.id}/photos",
        files={"file": ("room.jpg", b"fake-image-bytes", "image/jpeg")},
    )
    photo = (await db_session.execute(select(PropertyPhoto).where(PropertyPhoto.property_id == prop.id))).scalar_one()

    resp = await client.delete(f"/properties/{prop.id}/photos/{photo.id}")

    assert resp.status_code == 204
    remaining = (await db_session.execute(select(PropertyPhoto).where(PropertyPhoto.property_id == prop.id))).scalars().all()
    assert remaining == []


async def test_get_property_omits_broken_photo_link_instead_of_failing(client, db_session, make_landlord, make_room, monkeypatch):
    from app.core.storage import StorageError
    landlord = await make_landlord()
    _, prop = await make_room(landlord)
    photo = PropertyPhoto(property_id=prop.id, storage_key="broken/key.jpg", is_cover=True)
    db_session.add(photo)
    await db_session.commit()

    def _boom(*a, **k):
        raise StorageError("simulated storage outage")
    monkeypatch.setattr("app.api.properties.get_presigned_url", _boom)

    resp = await client.get(f"/properties/{prop.id}")

    assert resp.status_code == 200
    assert resp.json()["cover_photo_url"] is None
    assert resp.json()["photos"][0]["url"] == ""


async def test_delete_property_cascades_to_photos(client, db_session, auth_as, make_landlord, make_room, mock_storage):
    landlord = await make_landlord()
    _, prop = await make_room(landlord)
    auth_as(landlord.identity_id, "landlord")
    mock_storage(["app.api.properties"])
    await client.post(
        f"/properties/{prop.id}/photos",
        files={"file": ("room.jpg", b"fake-image-bytes", "image/jpeg")},
    )

    resp = await client.delete(f"/properties/{prop.id}")

    assert resp.status_code == 204
    assert (await db_session.execute(select(Property).where(Property.id == prop.id))).scalar_one_or_none() is None
