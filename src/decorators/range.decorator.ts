//number range attribute for validation
import { registerDecorator, ValidationOptions } from 'class-validator';
export function Range(
  min: number,
  max: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'range',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [min, max],
      validator: {
        validate(value: any, args: any) {
          const [minValue, maxValue] = args.constraints;
          return (
            typeof value === 'number' && value >= minValue && value <= maxValue
          );
        },
      },
    });
  };
}

export function RangeIf(
  property: string,
  expectedValue: any, // <-- allow checking for true, false, number, etc.
  min: number,
  max: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'rangeIf',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property, expectedValue, min, max],
      validator: {
        validate(value: any, args: any) {
          const [relatedPropertyName, expectedValue, minValue, maxValue] =
            args.constraints;
          const relatedValueFromObject = (args.object as any)[
            relatedPropertyName
          ];

          if (relatedValueFromObject === expectedValue) {
            return (
              typeof value === 'number' &&
              value >= minValue &&
              value <= maxValue
            );
          }
          return true;
        },
      },
    });
  };
}
