import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { IdentifyRequest } from '../types/contact';

const identifySchema = Joi.object({
  email: Joi.string().email().optional().allow(null),
  phoneNumber: Joi.string().optional().allow(null),
}).or('email', 'phoneNumber');

export const validateIdentifyRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = identifySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    res.status(400).json({
      error: 'Validation failed',
      details: messages,
    });
    return;
  }

  req.body = value as IdentifyRequest;
  next();
};
