import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import constants from 'src/constants';
import { HttpModule } from '@nestjs/axios';
import { NotificationsActor } from 'src/actors/notification.actor';
import { User, UserSchema } from 'src/schemas/user.schema.dto';
import { UserModule } from 'src/user/user.module';
import { ProxyHttpService } from 'src/providers/proxy-http.service';
import { FirebaseService } from 'src/providers/firebase.service';
import { GoogleAuthStrategy } from './google.auth.strategy';
import { UserRepository } from 'src/repositories/user.repository';
import { MailService } from 'src/providers/mail.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    ProxyHttpService,
    NotificationsActor,
    FirebaseService,
    GoogleAuthStrategy,
    UserRepository,
    MailService,
    ProxyHttpService,
  ],
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.register({
      global: true,
      secret: constants().secret,
      signOptions: { expiresIn: '3600000hrs' },
    }),
    UserModule,
    HttpModule.register({
      timeout: 5000,
    }),
  ],
})
export class AuthModule {}
