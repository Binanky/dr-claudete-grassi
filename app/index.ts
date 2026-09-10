import express from "express";
import app from "./server/_core/index";

// A importação explícita permite que o detector da Vercel reconheça este arquivo como uma aplicação Express.
void express;

export default app;
