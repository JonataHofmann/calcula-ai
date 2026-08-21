import { Injectable, Logger } from '@nestjs/common';
import { BANKS, CARD_BRANDS, ICONS, COLORS } from '@finance/contracts';

/** Serves the static reference catalogs bundled in @finance/contracts. */
@Injectable()
export class ReferenceService {
  private readonly logger = new Logger(ReferenceService.name);

  banks() {
    this.logger.log('Serving bank catalog');
    return { banks: BANKS };
  }

  brands() {
    this.logger.log('Serving card-brand catalog');
    return { brands: CARD_BRANDS };
  }

  icons() {
    this.logger.log('Serving icon catalog');
    return { icons: ICONS };
  }

  colors() {
    this.logger.log('Serving color catalog');
    return { colors: COLORS };
  }
}
