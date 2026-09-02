import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from './entities/category.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { UserHiddenCategoryEntity } from './entities/user-hidden-category.entity';
import { UserCategoryOverrideEntity } from './entities/user-category-override.entity';
import { UserCategoryParentEntity } from './entities/user-category-parent.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoryEntity,
      TransactionEntity,
      UserHiddenCategoryEntity,
      UserCategoryOverrideEntity,
      UserCategoryParentEntity,
    ]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
