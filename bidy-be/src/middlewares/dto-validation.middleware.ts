import {
  ClassConstructor,
  plainToInstance,
} from 'class-transformer';

import {
  validate,
  ValidationError,
} from 'class-validator';

import { Request, Response, NextFunction } from 'express';
import { apiResponse } from '../common/util/api-response.js';

type ValidationTarget = 'body' | 'query' | 'params';

function extractValidationErrors(
  errors: ValidationError[],
): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    if (error.constraints) {
      messages.push(
        ...Object.values(error.constraints),
      );
    }

    if (error.children?.length) {
      messages.push(
        ...extractValidationErrors(error.children),
      );
    }
  }

  return messages;
}

export function dtoValidationMiddleware<T extends object>(
  type: ClassConstructor<T>,
  target: ValidationTarget = 'body',
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const rawData = req[target];

      const dtoInstance = plainToInstance(
        type,
        rawData,
        {
          enableImplicitConversion: true,
        },
      );

      const errors = await validate(
        dtoInstance,
        {
          whitelist: true,
          forbidNonWhitelisted: true,
          forbidUnknownValues: true,
        },
      );

      if (errors.length > 0) {
        const messages =
          extractValidationErrors(errors);

        return res.status(400).json(
          apiResponse(
            'fail',
            'Validation Error',
            {
              errors: messages,
            },
          ),
        );
      }

      if (target === 'body') {
        req.body = dtoInstance;
      } else if (target === 'params') {
        Object.assign(req.params, dtoInstance);
      } else {
        res.locals.validatedQuery = dtoInstance;
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
