import * as yup from 'yup';

import { optionalDiverFields } from '@/shared/schemas/diver';
import { emailOptInField } from '@/shared/schemas/fields';
import { userProfileFields } from '@/shared/schemas/user-profile';

export const profileSchema = yup.object({
    ...userProfileFields,
    ...optionalDiverFields,
    emailOptIn: emailOptInField,
});

export type ProfileFormValues = yup.InferType<typeof profileSchema>;
