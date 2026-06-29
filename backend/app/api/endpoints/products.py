import os
import uuid

import aiofiles
from fastapi import APIRouter, Query, UploadFile, File

from app.api.deps import CatalogSvc, CurrentUser, require_designer
from app.core.errors import HorizonException
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter()

UPLOAD_DIR = "static/products"

_ALLOWED_DISTINCT_FIELDS = {"category", "trademark"}

# Catalog images are served to offline-first mobile clients that cache every blob
# in IndexedDB, so keep them small. The web client compresses to ~1600px before
# upload; this cap is a backstop against oversized originals (e.g. raw phone photos).
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


@router.get("", response_model=list[ProductOut])
async def list_products(service: CatalogSvc) -> list[ProductOut]:
    return await service.list_products()


@router.get("/distinct-values", response_model=list[str])
async def get_distinct_values(
    service: CatalogSvc, field: str = Query(...)
) -> list[str]:
    if field not in _ALLOWED_DISTINCT_FIELDS:
        raise HorizonException(
            400, f"field must be one of: {', '.join(_ALLOWED_DISTINCT_FIELDS)}"
        )
    return await service.get_distinct_values(field)


@router.post(
    "/upload-image",
    response_model=dict,
    status_code=201,
    dependencies=[require_designer],
)
async def upload_product_image(file: UploadFile = File(...)) -> dict:
    if not (file.content_type or "").startswith("image/"):
        raise HorizonException(400, "File must be an image")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _ALLOWED_IMAGE_EXTS:
        ext = ".jpg"
    content = await file.read()
    if len(content) > _MAX_IMAGE_BYTES:
        raise HorizonException(413, "Image too large (max 5 MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(content)
    return {"url": f"/static/products/{filename}"}


@router.post(
    "", response_model=ProductOut, status_code=201, dependencies=[require_designer]
)
async def create_product(
    body: ProductCreate, current_user: CurrentUser, service: CatalogSvc
) -> ProductOut:
    return await service.create_product(body, uuid.UUID(current_user["sub"]))


@router.put("/{product_id}", response_model=ProductOut, dependencies=[require_designer])
async def update_product(
    product_id: uuid.UUID, body: ProductUpdate, service: CatalogSvc
) -> ProductOut:
    return await service.update_product(product_id, body)


@router.delete("/{product_id}", status_code=204, dependencies=[require_designer])
async def delete_product(product_id: uuid.UUID, service: CatalogSvc) -> None:
    await service.delete_product(product_id)


@router.post(
    "/{product_id}/duplicate",
    response_model=ProductOut,
    status_code=201,
    dependencies=[require_designer],
)
async def duplicate_product(product_id: uuid.UUID, service: CatalogSvc) -> ProductOut:
    return await service.duplicate_product(product_id)
