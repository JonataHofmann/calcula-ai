import { Controller, Get } from '@nestjs/common';
import { BANKS, CARD_BRANDS, ICONS, COLORS } from '@finance/contracts';

/** Serves the static reference catalogs from @finance/contracts. Session required (global guard). */
@Controller('reference')
export class ReferenceController {
  @Get('banks')
  banks() {
    return { banks: BANKS };
  }

  @Get('brands')
  brands() {
    return { brands: CARD_BRANDS };
  }

  @Get('icons')
  icons() {
    return { icons: ICONS };
  }

  @Get('colors')
  colors() {
    return { colors: COLORS };
  }
}
