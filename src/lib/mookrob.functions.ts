import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getPublicRestaurant, getPublicRestaurants } from "./mookrob.server";

const nearbySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(100).max(200000),
  limit: z.number().int().min(1).max(100).default(60),
});

/** อ่านรายการร้านหมูกรอบใกล้พิกัดที่ระบุ (ข้อมูลสาธารณะ) */
export const listNearbyRestaurants = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => nearbySchema.parse(input))
  .handler(async ({ data }) => getPublicRestaurants(data));

/** อ่านรายละเอียดร้านหนึ่งร้าน พร้อมรายงานล่าสุด (ข้อมูลสาธารณะ) */
export const getRestaurantBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(input),
  )
  .handler(async ({ data }) => getPublicRestaurant(data));
