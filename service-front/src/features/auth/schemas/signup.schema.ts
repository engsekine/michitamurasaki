import * as yup from 'yup';

import { requiredDiverFields } from '@/shared/schemas/diver';
import {
    agreedToTermsField,
    emailField,
    emailOptInField,
    passwordConfirmField,
    passwordField,
} from '@/shared/schemas/fields';
import { userProfileFields } from '@/shared/schemas/user-profile';

export const signupSchema = yup.object({
    ...userProfileFields,
    ...requiredDiverFields,
    email: emailField,
    password: passwordField,
    passwordConfirm: passwordConfirmField,
    agreedToTerms: agreedToTermsField,
    emailOptIn: emailOptInField,
});

export type SignupFormValues = yup.InferType<typeof signupSchema>;
