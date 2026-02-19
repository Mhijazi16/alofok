import uuid

from fastapi import APIRouter

from app.api.deps import CatalogSvc, CurrentUser, require_designer
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter()


@router.get("", response_model=list[ProductOut])
async def list_products(service: CatalogSvc) -> list[ProductOut]:
    return await service.list_products()


@router.post("", response_model=ProductOut, status_code=201, dependencies=[require_designer])
async def create_product(
    body: ProductCreate, current_user: CurrentUser, service: CatalogSvc
) -> ProductOut:
    return await service.create_product(body, uuid.UUID(current_user["sub"]))


@router.put("/{product_id}", response_model=ProductOut, dependencies=[require_designer])
async def update_product(
    product_id: uuid.UUID, body: ProductUpdate, service: CatalogSvc
) -> ProductOut:
    return await service.update_product(product_id, body)
