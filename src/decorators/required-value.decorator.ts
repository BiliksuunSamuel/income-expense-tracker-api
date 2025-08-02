//create a required attribute decorator, that checks a property based on the type of value in another property

import { registerDecorator, ValidationOptions } from 'class-validator';
export function RequiredIf<T>(
  property: keyof T,
  value: any,
  validationOptions?: ValidationOptions,
) {
  return function (object: T, propertyName: string) {
    registerDecorator({
      name: 'requiredIf',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property, value],
      validator: {
        validate(currentValue: any, args: any) {
          const [relatedPropertyName, relatedValue] = args.constraints;
          const relatedValueFromObject = (args.object as any)[
            relatedPropertyName
          ];

          if (relatedValueFromObject === relatedValue) {
            return currentValue !== null && currentValue !== undefined;
          }
          return true;
        },
      },
    });
  };
}

export function RequiredIfNot<T>(
  property: keyof T,
  value: any,
  validationOptions?: ValidationOptions,
) {
  return function (object: T, propertyName: string) {
    registerDecorator({
      name: 'requiredIfNot',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property, value],
      validator: {
        validate(value: any, args: any) {
          const [relatedPropertyName, relatedValue] = args.constraints;
          const relatedValueFromObject = (args.object as any)[
            relatedPropertyName
          ];
          return (
            relatedValueFromObject === relatedValue ||
            (value !== null && value !== undefined)
          );
        },
      },
    });
  };
}
export function RequiredIfEmpty<T>(
  property: keyof T,
  validationOptions?: ValidationOptions,
) {
  return function (object: T, propertyName: string) {
    registerDecorator({
      name: 'requiredIfEmpty',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: any, args: any) {
          const [relatedPropertyName] = args.constraints;
          const relatedValueFromObject = (args.object as any)[
            relatedPropertyName
          ];
          return (
            relatedValueFromObject === '' ||
            (value !== null && value !== undefined)
          );
        },
      },
    });
  };
}
export function RequiredIfNotEmpty<T>(
  property: keyof T,
  validationOptions?: ValidationOptions,
) {
  return function (object: T, propertyName: string) {
    registerDecorator({
      name: 'requiredIfNotEmpty',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: any, args: any) {
          const [relatedPropertyName] = args.constraints;
          const relatedValueFromObject = (args.object as any)[
            relatedPropertyName
          ];
          return (
            relatedValueFromObject !== '' ||
            (value !== null && value !== undefined)
          );
        },
      },
    });
  };
}
export function RequiredIfTrue<T>(
  p0: string,
  p1: boolean,
  p2: { message: string },
  property: keyof T,
  validationOptions?: ValidationOptions,
) {
  return function (object: T, propertyName: string) {
    registerDecorator({
      name: 'requiredIfTrue',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: any, args: any) {
          const [relatedPropertyName] = args.constraints;
          const relatedValueFromObject = (args.object as any)[
            relatedPropertyName
          ];
          return (
            relatedValueFromObject === true ||
            (value !== null && value !== undefined)
          );
        },
      },
    });
  };
}
export function RequiredIfFalse<T>(
  property: keyof T,
  validationOptions?: ValidationOptions,
) {
  return function (object: T, propertyName: string) {
    registerDecorator({
      name: 'requiredIfFalse',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: any, args: any) {
          const [relatedPropertyName] = args.constraints;
          const relatedValueFromObject = (args.object as any)[
            relatedPropertyName
          ];
          return (
            relatedValueFromObject === false ||
            (value !== null && value !== undefined)
          );
        },
      },
    });
  };
}
