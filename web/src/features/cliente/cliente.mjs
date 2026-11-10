// web/tests/e2e/cliente.mjs
import { test, expect } from '@playwright/test';

test.describe('Pruebas E2E - Módulo Cliente (HU-C1 a HU-C5)', () => {

  test('HU-C1: Autoregistro de cliente en la ruta pública #/registro', async ({ page }) => {
    await page.goto('http://localhost:5173/#/registro');
    await expect(page.locator('h1')).toContainText('Registro de Cliente Nuevo');

    // Llenar datos de prueba
    await page.fill('input[placeholder="Juan Pérez"]', 'Cliente Pruebas E2E');
    await page.fill('input[placeholder="70000100"]', '78901234');
    await page.fill('input[placeholder="900000100"]', '987654321');
    await page.check('input[type="checkbox"]');

    // Enviar formulario
    await page.click('button:has-text("Completar Registro")');
  });

  test('HU-C2 a HU-C5: Flujo principal del cliente autenticado', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 1. Inicio de sesión con usuario simulado
    await page.fill('input[type="email"]', 'cliente@demo.test');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');

    // 2. HU-C2: Check-in Gimnasio
    await page.click('text=Check-in Gimnasio');
    await page.fill('input[type="text"]', '123456');
    await page.click('button:has-text("Marcar Entrada")');

    // 3. HU-C5: Mi Membresía
    await page.click('text=Mi Membresía');
    await expect(page.locator('body')).toContainText('Plan general');

    // 4. HU-C3 y HU-C4: Mis Reservas
    await page.click('text=Mis reservas');
    await expect(page.locator('body')).toContainText('Sauna');
  });

});