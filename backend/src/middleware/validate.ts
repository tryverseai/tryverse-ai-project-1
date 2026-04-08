import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const arr = errors.array();
    const first = arr[0];
    const summary =
      first && typeof first === 'object' && first !== null && 'msg' in first
        ? String((first as { msg: string }).msg)
        : 'Validation failed';
    res.status(400).json({
      error: summary,
      details: arr.map((e) => ({ field: e.type, message: e.msg })),
    });
    return;
  }
  next();
}
