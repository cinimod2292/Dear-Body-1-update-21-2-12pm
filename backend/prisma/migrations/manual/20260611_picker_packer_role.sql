-- Add the warehouse-only PICKER_PACKER staff role.
ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'PICKER_PACKER';
