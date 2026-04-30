import { Component } from '@angular/core';

@Component({
  selector: 'app-rodape',
  standalone: true,
  template: `<footer class="footer">AgregaAmigos - {{ year }}</footer>`
})
export class AppRodape {
  year = new Date().getFullYear();
}
