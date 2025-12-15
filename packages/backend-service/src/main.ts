import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { ValidationPipe } from "@nestjs/common"

// Patch BigInt to be JSON serializable
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Enable global validation pipe for DTOs
  app.useGlobalPipes(new ValidationPipe({ transform: true }))

  // Enable CORS
  app.enableCors()

  await app.listen(3000)
  console.log(`Application is running on: ${await app.getUrl()}`)
}
bootstrap()
