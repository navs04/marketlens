import { Router } from "express";
import { explanationController } from "../controllers/explanation.controller.js";

export const explanationRouter = Router();

explanationRouter.get("/", explanationController.get);
