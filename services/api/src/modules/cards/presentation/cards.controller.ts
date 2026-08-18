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
  type CreditCardDto,
  createCreditCardInput,
  type CreateCreditCardInput,
  updateCreditCardInput,
  type UpdateCreditCardInput,
} from '@finance/contracts';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '@finance/contracts';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import type { CreditCard } from '../domain/credit-card';
import { CreateCardUseCase } from '../application/use-cases/create-card/create-card.use-case';
import { ListCardsUseCase } from '../application/use-cases/list-cards/list-cards.use-case';
import { UpdateCardUseCase } from '../application/use-cases/update-card/update-card.use-case';
import { DeleteCardUseCase } from '../application/use-cases/delete-card/delete-card.use-case';

@Controller('cards')
export class CardsController {
  constructor(
    private readonly createCard: CreateCardUseCase,
    private readonly listCards: ListCardsUseCase,
    private readonly updateCard: UpdateCardUseCase,
    private readonly deleteCard: DeleteCardUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<CreditCardDto[]> {
    const cards = await this.listCards.execute(user.id);
    return cards.map(toDto);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCreditCardInput)) input: CreateCreditCardInput,
  ): Promise<CreditCardDto> {
    const card = await this.createCard.execute(user.id, input);
    return toDto(card);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCreditCardInput)) input: UpdateCreditCardInput,
  ): Promise<CreditCardDto> {
    const card = await this.updateCard.execute(user.id, id, input);
    return toDto(card);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteCard.execute(user.id, id);
  }
}

/** Domain -> HTTP contract. Only fields the client needs (no userId — FR-023). */
function toDto(card: CreditCard): CreditCardDto {
  return {
    id: card.id,
    name: card.name,
    lastDigits: card.lastDigits,
    dueDay: card.dueDay,
    closingDay: card.closingDay,
    limit: card.limit,
    brandId: card.brandId,
  } as CreditCardDto;
}
