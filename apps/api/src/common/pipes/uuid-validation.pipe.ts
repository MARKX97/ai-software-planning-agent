import { ParseUUIDPipe } from '@nestjs/common';

/** Shared UUID v4 validator for OpenAPI path parameters. */
export const UUID_V4_PIPE = new ParseUUIDPipe({ version: '4' });
