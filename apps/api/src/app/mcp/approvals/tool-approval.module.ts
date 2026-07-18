import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ToolApprovalEntity,
  ToolApprovalSchema,
} from './schemas/tool-approval.schema';
import { ToolApprovalService } from './tool-approval.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ToolApprovalEntity.name, schema: ToolApprovalSchema },
    ]),
  ],
  providers: [ToolApprovalService],
  exports: [ToolApprovalService],
})
export class ToolApprovalModule {}
