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
  UseGuards,
} from '@nestjs/common';
import {
  createCreditCardInput,
  type CreateCreditCardInput,
  updateCreditCardInput,
  type UpdateCreditCardInput,
  type AuthenticatedUser,
} from '@finance/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ServiceAccountGuard } from '../../common/guards/service-account.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CardsService } from './cards.service';
import { CardResponseDto } from './dto/card-response.dto';
import {
  createSyncedCardInput,
  type CreateSyncedCardInput,
} from './dto/create-synced-card.schema';

@Controller('cards')
export class CardsController {
  private readonly logger = new Logger(CardsController.name);

  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CardResponseDto[]> {
    this.logger.log(`GET /cards user=${user.id}`);
    return this.cards.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCreditCardInput)) input: CreateCreditCardInput,
  ): Promise<CardResponseDto> {
    this.logger.log(`POST /cards user=${user.id}`);
    return this.cards.create(user.id, input);
  }

  /** Cross-service creation from banking-ms's Pluggy sync — never in the public BFF/web API. */
  @Post('synced-create')
  @UseGuards(ServiceAccountGuard)
  createSynced(
    @Body(new ZodValidationPipe(createSyncedCardInput)) input: CreateSyncedCardInput,
  ): Promise<CardResponseDto> {
    const { userId, ...rest } = input;
    this.logger.log(`POST /cards/synced-create user=${userId}`);
    return this.cards.create(userId, rest);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCreditCardInput)) input: UpdateCreditCardInput,
  ): Promise<CardResponseDto> {
    this.logger.log(`PATCH /cards/${id} user=${user.id}`);
    return this.cards.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.log(`DELETE /cards/${id} user=${user.id}`);
    await this.cards.delete(user.id, id);
  }
}
