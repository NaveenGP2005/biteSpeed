import { Router, Request, Response } from 'express';
import contactService from '../services/contactService';
import { validateIdentifyRequest } from '../middleware/validation';
import { IdentifyRequest } from '../types/contact';

const router = Router();

/**
 * POST /identify
 * Identifies and reconciles contacts based on email and/or phoneNumber
 */
router.post('/', validateIdentifyRequest, async (req: Request, res: Response) => {
  try {
    const request: IdentifyRequest = req.body;
    const contact = await contactService.identify(request);

    res.status(200).json({ contact });
  } catch (error) {
    console.error('Error in identify endpoint:', error);
    
    if (error instanceof Error) {
      res.status(400).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
});

export default router;
