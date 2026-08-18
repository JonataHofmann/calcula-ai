import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CATEGORY_REPOSITORY } from './domain/category.repository';
import { HIDDEN_CATEGORY_REPOSITORY } from './domain/hidden-category.repository';
import { CATEGORY_OVERRIDE_REPOSITORY } from './domain/category-override.repository';
import { CategoryEntity } from './infrastructure/persistence/entities/category.entity';
import { UserHiddenCategoryEntity } from './infrastructure/persistence/entities/user-hidden-category.entity';
import { UserCategoryOverrideEntity } from './infrastructure/persistence/entities/user-category-override.entity';
import { TypeOrmCategoryRepository } from './infrastructure/persistence/repositories/category.repository';
import { TypeOrmHiddenCategoryRepository } from './infrastructure/persistence/repositories/hidden-category.repository';
import { TypeOrmCategoryOverrideRepository } from './infrastructure/persistence/repositories/category-override.repository';
import { ListEffectiveCategoriesUseCase } from './application/use-cases/list-effective-categories/list-effective-categories.use-case';
import { CreateCustomCategoryUseCase } from './application/use-cases/create-custom-category/create-custom-category.use-case';
import { AddSubcategoryUseCase } from './application/use-cases/add-subcategory/add-subcategory.use-case';
import { UpdateCategoryUseCase } from './application/use-cases/update-category/update-category.use-case';
import { DeleteCategoryUseCase } from './application/use-cases/delete-category/delete-category.use-case';
import { RestoreDefaultCategoryUseCase } from './application/use-cases/restore-default-category/restore-default-category.use-case';
import { RevertCategoryOverrideUseCase } from './application/use-cases/revert-category-override/revert-category-override.use-case';
import { CategoriesController } from './presentation/categories.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoryEntity,
      UserHiddenCategoryEntity,
      UserCategoryOverrideEntity,
    ]),
  ],
  controllers: [CategoriesController],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: TypeOrmCategoryRepository },
    { provide: HIDDEN_CATEGORY_REPOSITORY, useClass: TypeOrmHiddenCategoryRepository },
    { provide: CATEGORY_OVERRIDE_REPOSITORY, useClass: TypeOrmCategoryOverrideRepository },
    ListEffectiveCategoriesUseCase,
    CreateCustomCategoryUseCase,
    AddSubcategoryUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
    RestoreDefaultCategoryUseCase,
    RevertCategoryOverrideUseCase,
  ],
})
export class CategoriesModule {}
