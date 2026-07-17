import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChatApiService } from '../../core/chat-api.service';
import { ChatPage } from './chat-page';

describe('ChatPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatPage],
      providers: [
        provideRouter([]),
        {
          provide: ChatApiService,
          useValue: {
            list: () => of([]),
            create: () =>
              of({
                _id: '507f1f77bcf86cd799439011',
                title: 'New chat',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }),
          },
        },
      ],
    }).compileComponents();
  });

  it('shows the new conversation welcome state', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain(
      'What are we',
    );
  });
});
