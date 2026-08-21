import { Controller, Get, Logger } from '@nestjs/common';
import { ReferenceService } from './reference.service';

/** Serves the static reference catalogs from @finance/contracts. Session required (global guard). */
@Controller('reference')
export class ReferenceController {
  private readonly logger = new Logger(ReferenceController.name);

  constructor(private readonly reference: ReferenceService) {}

  @Get('banks')
  banks() {
    this.logger.log('GET /reference/banks');
    return this.reference.banks();
  }

  @Get('brands')
  brands() {
    this.logger.log('GET /reference/brands');
    return this.reference.brands();
  }

  @Get('icons')
  icons() {
    this.logger.log('GET /reference/icons');
    return this.reference.icons();
  }

  @Get('colors')
  colors() {
    this.logger.log('GET /reference/colors');
    return this.reference.colors();
  }
}
