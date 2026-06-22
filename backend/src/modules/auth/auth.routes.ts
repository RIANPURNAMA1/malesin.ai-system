import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';

const router = Router();
const ctrl = new AuthController();

router.post('/register', [
  body('companyName').notEmpty().trim(),
  body('companyEmail').isEmail().normalizeEmail(),
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  validate,
], ctrl.register.bind(ctrl));

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
], ctrl.login.bind(ctrl));

router.post('/refresh', [
  body('refreshToken').notEmpty(),
  validate,
], ctrl.refresh.bind(ctrl));

router.post('/logout', authenticate, ctrl.logout.bind(ctrl));
router.get('/profile', authenticate, ctrl.profile.bind(ctrl));

export default router;
