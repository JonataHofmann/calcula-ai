import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
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
  MoveCategoryInput,
  UpdateCategoryInput,
} from '@finance/contracts';
import type { Request } from 'express';
import { CategoriesService } from './categories.service';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies category CRUD (custom + default hide/override) to the API-MS, scoped by the session token. */
@Controller('categories')
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@Req() req: SessionRequest): Promise<CategoryTreeDto> {
    this.logger.log('GET /categories');
    return this.categories.list(tokenOf(req));
  }

  @Post()
  create(
    @Req() req: SessionRequest,
    @Body() body: CreateCategoryInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    this.logger.log('POST /categories');
    return this.categories.create(tokenOf(req), body, idempotencyKey);
  }

  @Post(':parentId/subcategories')
  addChild(
    @Req() req: SessionRequest,
    @Param('parentId') parentId: string,
    @Body() body: CreateSubcategoryInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`POST /categories/${parentId}/subcategories`);
    return this.categories.addChild(tokenOf(req), parentId, body, idempotencyKey);
  }

  @Patch(':id/move')
  move(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: MoveCategoryInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`PATCH /categories/${id}/move`);
    return this.categories.move(tokenOf(req), id, body, idempotencyKey);
  }

  @Patch(':id')
  update(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: UpdateCategoryInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`PATCH /categories/${id}`);
    return this.categories.update(tokenOf(req), id, body, idempotencyKey);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    this.logger.log(`DELETE /categories/${id}`);
    return this.categories.remove(tokenOf(req), id, idempotencyKey);
  }

  @Post(':id/restore')
  @HttpCode(204)
  restore(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    this.logger.log(`POST /categories/${id}/restore`);
    return this.categories.restore(tokenOf(req), id, idempotencyKey);
  }

  @Delete(':id/override')
  @HttpCode(204)
  revert(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    this.logger.log(`DELETE /categories/${id}/override`);
    return this.categories.revert(tokenOf(req), id, idempotencyKey);
  }
}
