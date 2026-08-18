import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import type { Category } from '../domain/category';
import { ListEffectiveCategoriesUseCase } from '../application/use-cases/list-effective-categories/list-effective-categories.use-case';
import { CreateCustomCategoryUseCase } from '../application/use-cases/create-custom-category/create-custom-category.use-case';
import { AddSubcategoryUseCase } from '../application/use-cases/add-subcategory/add-subcategory.use-case';
import { UpdateCategoryUseCase } from '../application/use-cases/update-category/update-category.use-case';
import { DeleteCategoryUseCase } from '../application/use-cases/delete-category/delete-category.use-case';
import { RestoreDefaultCategoryUseCase } from '../application/use-cases/restore-default-category/restore-default-category.use-case';
import { RevertCategoryOverrideUseCase } from '../application/use-cases/revert-category-override/revert-category-override.use-case';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly listCategories: ListEffectiveCategoriesUseCase,
    private readonly createCategory: CreateCustomCategoryUseCase,
    private readonly addSubcategory: AddSubcategoryUseCase,
    private readonly updateCategory: UpdateCategoryUseCase,
    private readonly deleteCategory: DeleteCategoryUseCase,
    private readonly restoreDefault: RestoreDefaultCategoryUseCase,
    private readonly revertOverride: RevertCategoryOverrideUseCase,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CategoryTreeDto> {
    return this.listCategories.execute(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCategoryInput)) input: CreateCategoryInput,
  ): Promise<CategoryNodeDto> {
    const category = await this.createCategory.execute(user.id, input);
    return toNode(category);
  }

  @Post(':parentId/subcategories')
  async addChild(
    @CurrentUser() user: AuthenticatedUser,
    @Param('parentId', ParseUUIDPipe) parentId: string,
    @Body(new ZodValidationPipe(createSubcategoryInput)) input: CreateSubcategoryInput,
  ): Promise<CategoryNodeDto> {
    const category = await this.addSubcategory.execute(user.id, parentId, input);
    return toNode(category);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCategoryInput)) input: UpdateCategoryInput,
  ): Promise<CategoryNodeDto> {
    return this.updateCategory.execute(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteCategory.execute(user.id, id);
  }

  @Post(':id/restore')
  @HttpCode(204)
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.restoreDefault.execute(user.id, id);
  }

  @Delete(':id/override')
  @HttpCode(204)
  async revert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.revertOverride.execute(user.id, id);
  }
}

/** Domain -> HTTP contract for a freshly created custom node (no children yet). */
function toNode(category: Category): CategoryNodeDto {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    type: category.type,
    source: 'custom',
    children: [],
  } as CategoryNodeDto;
}
