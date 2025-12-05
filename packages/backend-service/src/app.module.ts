import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { UsersModule } from "./modules/users/users.module"
import { ProofsModule } from "./modules/proofs/proofs.module"
import { ConfidentialTransfersModule } from "./modules/confidential-transfers/confidential-transfers.module"
import configuration from "./common/config/configuration"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    UsersModule,
    ProofsModule,
    ConfidentialTransfersModule,
  ],
})
export class AppModule {}
