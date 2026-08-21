import { Injectable, Logger } from '@nestjs/common';
import type {
  CategoryNodeDto,
  CategoryTreeDto,
  CreateCategoryInput,
  CreateSubcategoryInput,
  UpdateCategoryInput,
} from '@finance/contracts';
import { ApiClient } from '../../common/api-client';

/** Proxies category CRUD (custom + default hide/override) to the API-MS; rules live upstream. */
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly api: ApiClient) {}

  list(token: string): Promise<CategoryTreeDto> {
    this.logger.log('Proxying GET /categories');
    return this.api.get<CategoryTreeDto>('/categories', { token });
  }

  create(
    token: string,
    body: CreateCategoryInput,
    idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    this.logger.log('Proxying POST /categories');
    return this.api.post<CategoryNodeDto>('/categories', { token, body, idempotencyKey });
  }

  addChild(
    token: string,
    parentId: string,
    body: CreateSubcategoryInput,
    idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`Proxying POST /categories/${parentId}/subcategories`);
    return this.api.post<CategoryNodeDto>(`/categories/${parentId}/subcategories`, {
      token,
      body,
      idempotencyKey,
    });
  }

  update(
    token: string,
    id: string,
    body: UpdateCategoryInput,
    idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`Proxying PATCH /categories/${id}`);
    return this.api.patch<CategoryNodeDto>(`/categories/${id}`, { token, body, idempotencyKey });
  }

  remove(token: string, id: string, idempotencyKey?: string): Promise<void> {
    this.logger.log(`Proxying DELETE /categories/${id}`);
    return this.api.delete<void>(`/categories/${id}`, { token, idempotencyKey });
  }

  restore(token: string, id: string, idempotencyKey?: string): Promise<void> {
    this.logger.log(`Proxying POST /categories/${id}/restore`);
    return this.api.post<void>(`/categories/${id}/restore`, { token, idempotencyKey });
  }

  revert(token: string, id: string, idempotencyKey?: string): Promise<void> {
    this.logger.log(`Proxying DELETE /categories/${id}/override`);
    return this.api.delete<void>(`/categories/${id}/override`, { token, idempotencyKey });
  }
}
