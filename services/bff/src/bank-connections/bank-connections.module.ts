import { Module } from '@nestjs/common';
import { BankConnectionsController } from './bank-connections.controller';

@Module({ controllers: [BankConnectionsController] })
export class BankConnectionsModule {}
