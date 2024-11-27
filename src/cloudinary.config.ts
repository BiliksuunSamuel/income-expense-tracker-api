import * as cloudinary from 'cloudinary';
import configuration from './configuration';

export const cloudinaryConfiguration = cloudinary.v2.config({
  cloud_name: configuration().cloudName,
  api_key: configuration().apiKey,
  api_secret: configuration().apiSecret,
});
