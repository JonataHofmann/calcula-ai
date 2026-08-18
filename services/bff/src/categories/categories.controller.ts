import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type {
  CategoryNodeDto,
  CategoryTreeDto,
  CreateCategoryInput,
  CreateSubcategoryInput,
  UpdateCategoryInput,
} from '@finance/contracts';
import type { Request } from 'express';
import { ApiClient } from '../shared/api-client';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies category CRUD (custom + default hide/override) to the API-MS, scoped by the caller's session token. */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly api: ApiClient) {}

  @Get()
  list(@Req() req: SessionRequest): Promise<CategoryTreeDto> {
    return this.api.get<CategoryTreeDto>('/categories', { token: tokenOf(req) });
  }

  @Post()
  create(
    @Req() req: SessionRequest,
    @Body() body: CreateCategoryInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    return this.api.post<CategoryNodeDto>('/categories', {
      token: tokenOf(req),
      body,
      idempotencyKey,
    });
  }

  @Post(':parentId/subcategories')
  addChild(
    @Req() req: SessionRequest,
    @Param('parentId') parentId: string,
    @Body() body: CreateSubcategoryInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    return this.api.post<CategoryNodeDto>(`/categories/${parentId}/subcategories`, {
      token: tokenOf(req),
      body,
      idempotencyKey,
    });
  }

  @Patch(':id')
  update(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: UpdateCategoryInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    return this.api.patch<CategoryNodeDto>(`/categories/${id}`, {
      token: tokenOf(req),
      body,
      idempotencyKey,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    return this.api.delete<void>(`/categories/${id}`, {
      token: tokenOf(req),
      idempotencyKey,
    });
  }

  @Post(':id/restore')
  @HttpCode(204)
  restore(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    return this.api.post<void>(`/categories/${id}/restore`, {
      token: tokenOf(req),
      idempotencyKey,
    });
  }

  @Delete(':id/override')
  @HttpCode(204)
  revert(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    return this.api.delete<void>(`/categories/${id}/override`, {
      token: tokenOf(req),
      idempotencyKey,
    });
  }
}
