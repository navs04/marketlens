import { Router } from "express";
import { priceController } from "../controllers/price.controller.js";

export const priceRouter = Router();

// Specific paths registered before the general list route.
priceRouter.get("/latest", priceController.latest);
priceRouter.get("/summary", priceController.summary);
priceRouter.get("/compare", priceController.compare);
priceRouter.get("/", priceController.list);
