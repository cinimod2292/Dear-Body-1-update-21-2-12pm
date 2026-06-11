-- Add PICKING to OrderStatus enum
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKING';
