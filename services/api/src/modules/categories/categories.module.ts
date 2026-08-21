import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from './entities/category.entity';
import { UserHiddenCategoryEntity } from './entities/user-hidden-category.entity';
import { UserCategoryOverrideEntity } from './entities/user-category-override.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoryEntity,
      UserHiddenCategoryEntity,
      UserCategoryOverrideEntity,
    ]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
