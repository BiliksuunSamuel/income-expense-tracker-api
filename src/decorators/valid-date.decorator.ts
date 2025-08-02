import { Logger } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsDateValidConstraint implements ValidatorConstraintInterface {
  private readonly logger = new Logger(IsDateValidConstraint.name);
  validate(value: any, args: ValidationArguments) {
    // `args.property` gives us the name of the property dynamically
    const propertyName = args.property;
    // Check if the value is a valid DateTime object
    var parsedValue = new Date(value);
    var results = parsedValue instanceof Date && !isNaN(parsedValue.getTime());
    this.logger.log(
      `Validating property: ${propertyName}`,
      value,
      results,
      parsedValue,
    );
    //if the value is a valid Date object, bind the value to the property
    if (results) {
      args.object[propertyName] = parsedValue;
    }
    return results;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid Date object.`;
  }
}

export function IsDateValid(validationOptions?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      target: target.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsDateValidConstraint,
    });
  };
}
