import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import {
  customerAddressDefaultSchema,
  customerAddressSchema,
  customerAddressUpdateSchema,
  customerProfileUpdateSchema,
} from "./store-account.schemas.js";

export async function getMyProfile(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true, updatedAt: true },
  });
  if (!customer) throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
  return customer;
}

export async function updateMyProfile(customerId: string, rawBody: unknown) {
  const body = customerProfileUpdateSchema.parse(rawBody);
  return prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
    },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true, updatedAt: true },
  });
}

export async function listMyAddresses(customerId: string) {
  return prisma.address.findMany({
    where: { customerId },
    orderBy: [{ isDefaultShipping: "desc" }, { isDefaultBilling: "desc" }, { updatedAt: "desc" }],
  });
}

async function enforceDefaults(customerId: string, addressId: string, shipping?: boolean, billing?: boolean) {
  if (shipping) {
    await prisma.address.updateMany({ where: { customerId, id: { not: addressId } }, data: { isDefaultShipping: false } });
    await prisma.address.update({ where: { id: addressId }, data: { isDefaultShipping: true } });
  }
  if (billing) {
    await prisma.address.updateMany({ where: { customerId, id: { not: addressId } }, data: { isDefaultBilling: false } });
    await prisma.address.update({ where: { id: addressId }, data: { isDefaultBilling: true } });
  }
}

export async function addMyAddress(customerId: string, rawBody: unknown) {
  const body = customerAddressSchema.parse(rawBody);
  const existingCount = await prisma.address.count({ where: { customerId } });

  const created = await prisma.address.create({
    data: {
      customerId,
      recipientName: body.recipientName,
      label: body.label,
      firstName: body.firstName,
      lastName: body.lastName,
      company: body.company,
      phone: body.phone,
      line1: body.line1,
      line2: body.line2,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country,
      deliveryNotes: body.deliveryNotes,
      isDefaultShipping: body.isDefaultShipping ?? existingCount === 0,
      isDefaultBilling: body.isDefaultBilling ?? existingCount === 0,
    },
  });

  await enforceDefaults(customerId, created.id, created.isDefaultShipping, created.isDefaultBilling);
  return prisma.address.findUniqueOrThrow({ where: { id: created.id } });
}

async function getOwnedAddress(customerId: string, addressId: string) {
  const address = await prisma.address.findFirst({ where: { id: addressId, customerId } });
  if (!address) throw new AppError(404, "Address not found", "ADDRESS_NOT_FOUND");
  return address;
}

export async function updateMyAddress(customerId: string, addressId: string, rawBody: unknown) {
  await getOwnedAddress(customerId, addressId);
  const body = customerAddressUpdateSchema.parse(rawBody);

  const updated = await prisma.address.update({
    where: { id: addressId },
    data: body,
  });

  await enforceDefaults(customerId, updated.id, Boolean(body.isDefaultShipping), Boolean(body.isDefaultBilling));
  return prisma.address.findUniqueOrThrow({ where: { id: addressId } });
}

export async function setMyAddressDefault(customerId: string, addressId: string, rawBody: unknown) {
  await getOwnedAddress(customerId, addressId);
  const body = customerAddressDefaultSchema.parse(rawBody);
  if (body.type === "shipping") {
    await enforceDefaults(customerId, addressId, true, false);
  } else {
    await enforceDefaults(customerId, addressId, false, true);
  }
  return prisma.address.findUniqueOrThrow({ where: { id: addressId } });
}

export async function deleteMyAddress(customerId: string, addressId: string) {
  const address = await getOwnedAddress(customerId, addressId);
  await prisma.address.delete({ where: { id: addressId } });

  const remaining = await prisma.address.findMany({ where: { customerId }, orderBy: { updatedAt: "desc" } });
  if (remaining.length === 0) return;

  if (address.isDefaultShipping && !remaining.some((a) => a.isDefaultShipping)) {
    await enforceDefaults(customerId, remaining[0].id, true, false);
  }
  if (address.isDefaultBilling && !remaining.some((a) => a.isDefaultBilling)) {
    await enforceDefaults(customerId, remaining[0].id, false, true);
  }
}
