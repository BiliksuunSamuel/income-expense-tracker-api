//Deocrator to validate if the value in a property is part of the allowed values

import { Logger } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsAllowedValuesConstraint implements ValidatorConstraintInterface {
  private readonly logger = new Logger(IsAllowedValuesConstraint.name);

  validate(value: any, args: ValidationArguments) {
    const allowedValues = args.constraints[0];
    const propertyName = args.property;

    this.logger.log(
      `Validating property: ${propertyName}, value: ${value}, allowed values: ${allowedValues}`,
    );

    // Check if the value is in the allowed values array
    const isValid = allowedValues.includes(value);

    if (!isValid) {
      this.logger.warn(
        `Validation failed for property: ${propertyName}, value: ${value}`,
      );
    }

    return isValid;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be one of the following values: ${args.constraints[0].join(', ')}.`;
  }
}

export function IsAllowedValues(
  allowedValues: any[],
  validationOptions?: ValidationOptions,
) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      target: target.constructor,
      propertyName,
      options: validationOptions,
      constraints: [allowedValues],
      validator: IsAllowedValuesConstraint,
    });
  };
}
