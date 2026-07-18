import { IsBoolean } from 'class-validator';

export class ResolveToolApprovalDto {
  @IsBoolean()
  approved!: boolean;
}
