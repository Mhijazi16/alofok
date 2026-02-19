import os
import uuid

import aiofiles
from fastapi import APIRouter, UploadFile, File

from app.api.deps import CatalogSvc, CurrentUser, require_designer
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter()

UPLOAD_DIR = "static/products"


@router.get("", response_model=list[ProductOut])
async def list_products(service: CatalogSvc) -> list[ProductOut]:
    return await service.list_products()


@router.post(
    "/upload-image",
    response_model=dict,
    status_code=201,
    dependencies=[require_designer],
)
async def upload_product_image(file: UploadFile = File(...)) -> dict:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        content = await file.read()
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
