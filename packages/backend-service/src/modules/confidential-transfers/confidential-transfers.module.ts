import { Module } from '@nestjs/common';
import { ConfidentialTransfersService } from './confidential-transfers.service';
import { ConfidentialTransfersController } from './confidential-transfers.controller';
import { UsersModule } from '../users/users.module';
import { ProofsModule } from '../proofs/proofs.module';

@Module({
  imports: [UsersModule, ProofsModule],
  controllers: [ConfidentialTransfersController],
  providers: [ConfidentialTransfersService],
})
export class ConfidentialTransfersModule {}

