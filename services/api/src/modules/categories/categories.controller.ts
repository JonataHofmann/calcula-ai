import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type AuthenticatedUser,
  type CategoryNodeDto,
  type CategoryTreeDto,
  createCategoryInput,
  type CreateCategoryInput,
  createSubcategoryInput,
  type CreateSubcategoryInput,
  updateCategoryInput,
  type UpdateCategoryInput,
} from '@finance/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CategoriesService } from './categories.service';

/** HTTP boundary for categories: routing/validation only, all logic in {@link CategoriesService}. */
@Controller('categories')
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CategoryTreeDto> {
    this.logger.log(`GET /categories user=${user.id}`);
    return this.categories.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCategoryInput)) input: CreateCategoryInput,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`POST /categories user=${user.id}`);
    return this.categories.create(user.id, input);
  }

  @Post(':parentId/subcategories')
  addChild(
    @CurrentUser() user: AuthenticatedUser,
    @Param('parentId', ParseUUIDPipe) parentId: string,
    @Body(new ZodValidationPipe(createSubcategoryInput)) input: CreateSubcategoryInput,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`POST /categories/${parentId}/subcategories user=${user.id}`);
    return this.categories.addSubcategory(user.id, parentId, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCategoryInput)) input: UpdateCategoryInput,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`PATCH /categories/${id} user=${user.id}`);
    return this.categories.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.log(`DELETE /categories/${id} user=${user.id}`);
    await this.categories.delete(user.id, id);
  }

  @Post(':id/restore')
  @HttpCode(204)
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.log(`POST /categories/${id}/restore user=${user.id}`);
    await this.categories.restore(user.id, id);
  }

  @Delete(':id/override')
  @HttpCode(204)
  async revert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.log(`DELETE /categories/${id}/override user=${user.id}`);
    await this.categories.revert(user.id, id);
  }
}
