import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as exempt from {@link AuthGuard} (health, models list/detail).
 * @internal
 */
export const IS_PUBLIC_KEY = 'isPublic';

export const Public = (): MethodDecorator => SetMetadata(IS_PUBLIC_KEY, true);
